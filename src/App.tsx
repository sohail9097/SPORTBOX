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
import { ThemeProvider } from './lib/ThemeContext';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live" element={<Live />} />
              <Route path="/category/:category" element={<CategoryPage />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
