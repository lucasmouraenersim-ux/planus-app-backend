
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyASyZjkbeiSqh9fEaYDwuS9diyIDUhEQeQ",
  authDomain: "energisa-invoice-editor.firebaseapp.com",
  projectId: "energisa-invoice-editor",
  storageBucket: "energisa-invoice-editor.firebasestorage.app",
  messagingSenderId: "435065861023",
  appId: "1:435065861023:web:da3a50114964b4747f83aa"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo-sent-energia.png', // You should have a logo here
    badge: '/logo-sent-energia.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
