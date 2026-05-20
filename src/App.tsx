import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { ThemeProvider } from './lib/ThemeContext';
import { AuthProvider } from './hooks/useAuth';

import { Toaster } from 'sonner';

function App() {
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
