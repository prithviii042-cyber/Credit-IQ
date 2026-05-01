import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import UploadPage from './pages/UploadPage';
import PortfolioPage from './pages/PortfolioPage';
import CustomerDetailPage from './pages/CustomerDetailPage';

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-4">
      <p className="text-center text-xs text-gray-400">
        CreditIQ &mdash; Powered by D&amp;B Bureau Data + Claude AI
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/customer/:id" element={<CustomerDetailPage />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
