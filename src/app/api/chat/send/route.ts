import { NextRequest, NextResponse } from 'next/server';
import { sendChatMessage, type SendChatMessageInput } from '@/actions/chat/sendChatMessage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SendChatMessageInput;
    console.log('[API /chat/send] Received request with body:', JSON.stringify(body, null, 2));

    const { leadId, phone, text, sender } = body;

    // Basic validation to ensure core fields are present
    if (!leadId || !text || !sender) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields in request body: leadId, text, and sender are required." 
      }, { status: 400 });
    }

    // Call the existing server action
    const result = await sendChatMessage({
      leadId,
      phone,
      text,
      sender,
    });

    console.log('[API /chat/send] Server action result:', result);

    // Return the result from the action
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      // If the action itself reports a failure, use a 500 status code
      // to indicate a server-side issue.
      return NextResponse.json({ 
        success: false, 
        message: result.message || 'An unknown error occurred in the server action.' 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API /chat/send] CRITICAL ERROR processing request:', error);
    // Catches issues like JSON parsing errors or other unexpected exceptions
    return NextResponse.json({ 
        success: false, 
        message: `Server error: ${error.message}` 
    }, { status: 500 });
  }
}
