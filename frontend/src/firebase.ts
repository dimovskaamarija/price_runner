import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAOnTJN27hK6PyGpQ2Q5CnKQA3j1SHaLnM",
    authDomain: "price-runner-88b3f.firebaseapp.com",
    projectId: "price-runner-88b3f",
    storageBucket: "price-runner-88b3f.firebasestorage.app",
    messagingSenderId: "524127434039",
    appId: "1:524127434039:web:c58af74d78744d52f716b2",
    measurementId: "G-9270PPKN6V"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
