// db-config.js
const firebaseConfig = {
  apiKey: "AIzaSyA676bNuAgGG3cdZ8oqclcZbfhBFpdqS44",
  authDomain: "babershop-87a39.firebaseapp.com",
  projectId: "babershop-87a39",
  storageBucket: "babershop-87a39.firebasestorage.app",
  messagingSenderId: "772113890386",
  appId: "1:772113890386:web:f2c3ff87e32f7598b5738b",
  measurementId: "G-3S066MJ833"
};

// Initialize Firebase only ONCE
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();
