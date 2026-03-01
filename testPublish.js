import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyB3-test_key",
  authDomain: "imposter-sandeshg.firebaseapp.com",
  databaseURL: "https://imposter-sandeshg-default-rtdb.firebaseio.com",
  projectId: "imposter-sandeshg",
  storageBucket: "imposter-sandeshg.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function test() {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Signed in anonymously:", userCredential.user.uid);
    const catId = Date.now().toString();
    const catRef = ref(db, `communityCategories/${catId}`);
    await set(catRef, {
      id: catId,
      name: "NodeJS Test Cat",
      words: ["Apple", "Banana", "Cherry"],
      icon: "🧪",
      authorName: "Test Guest",
      authorUid: userCredential.user.uid,
      upvotes: 0,
      timestamp: Date.now()
    });
    console.log("Publish SUCCESS!");
    process.exit(0);
  } catch (err) {
    console.error("Publish FAILED:", err);
    process.exit(1);
  }
}
test();
