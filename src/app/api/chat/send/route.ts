import { NextRequest, NextResponse } from 'next/server';
import { sendChatMessage, type SendChatMessageInput } from '@/actions/chat/sendChatMessage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SendChatMessageInput;
    console.log('[API /chat/send] Received request with body:', JSON.stringify(body, null, 2));

    const { leadId, phone, text, sender } = body;

    if (!leadId || !text || !sender) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields in request body: leadId, text, and sender are required." 
      }, { status: 400 });
    }

    const result = await sendChatMessage({
      leadId,
      phone,
      text,
      sender,
    });

    console.log('[API /chat/send] Server action result:', result);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    }
    
    // If the error message indicates "not found", return a 404 status.
    if (result.message && result.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ 
          success: false, 
          message: result.message
      }, { status: 404 });
    }

    // For all other failures, return a 500 status code.
    return NextResponse.json({ 
      success: false, 
      message: result.message || 'An unknown error occurred in the server action.' 
    }, { status: 500 });

  } catch (error: any) {
    console.error('[API /chat/send] CRITICAL ERROR processing request:', error);
    return NextResponse.json({ 
        success: false, 
        message: `Server error: ${error.message}` 
    }, { status: 500 });
  }
}
