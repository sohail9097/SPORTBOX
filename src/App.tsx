import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { db } from './lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Live from './pages/Live';
import CategoryPage from './pages/CategoryPage';
import Watch from './pages/Watch';
import Plans from './pages/Plans';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Search from './pages/Search';
import Login from './pages/Login';
import Legal from './pages/Legal';
import DataDeletion from './pages/DataDeletion';
import Shots from './pages/Shots';
import Blogs from './pages/Blogs';
import Olympics from './pages/Olympics';
import { ThemeProvider } from './lib/ThemeContext';
import { AuthProvider } from './hooks/useAuth';

import { Toaster } from 'sonner';

function App() {
  useEffect(() => {
    // One-time initialization to reset existing views of ALL media content in the database to 0
    const resetAllViewsToZeroOnce = async () => {
      const key = 'has_reset_all_views_to_zero_v5';
      if (localStorage.getItem(key)) return;
      try {
        const q = query(collection(db, 'content'));
        const snap = await getDocs(q);
        const promises = snap.docs.map(docSnap => {
          const data = docSnap.data();
          if ((data.viewCount || 0) > 0) {
            return updateDoc(doc(db, 'content', docSnap.id), { viewCount: 0 });
          }
          return null;
        }).filter(Boolean);
        
        if (promises.length > 0) {
          await Promise.all(promises);
          console.log(`Successfully reset viewCount for ${promises.length} content items to 0.`);
        }
        localStorage.setItem(key, 'true');
      } catch (error) {
        console.error('Failed to run initial all views reset script:', error);
      }
    };
    resetAllViewsToZeroOnce();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Toaster position="top-center" richColors />
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/live" element={<Live />} />
              <Route path="/category/:category" element={<CategoryPage />} />
              <Route path="/shorts" element={<Shots />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/search" element={<Search />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/olympics" element={<Olympics />} />
              <Route path="/legal/privacy" element={<Legal />} />
              <Route path="/legal/terms" element={<Legal />} />
              <Route path="/legal/cookies" element={<Legal />} />
              <Route path="/data-deletion" element={<DataDeletion />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
