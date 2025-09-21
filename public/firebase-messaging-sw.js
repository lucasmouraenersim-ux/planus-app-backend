// This service worker file is intentionally left almost empty.
// It's needed for Firebase Cloud Messaging to work in the background.
// Firebase will handle the background notification display automatically.

// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyASyZjkbeiSqh9fEaYDwuS9diyIDUhEQeQ",
  authDomain: "energisa-invoice-editor.firebaseapp.com",
  projectId: "energisa-invoice-editor",
  storageBucket: "energisa-invoice-editor.firebasestorage.app",
  messagingSenderId: "435065861023",
  appId: "1:435065861023:web:da3a50114964b4747f83aa"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

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
    icon: '/firebase-logo.png' // Optional: you can add an icon
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
