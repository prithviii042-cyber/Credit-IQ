import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import UploadPage from './pages/UploadPage';
import PortfolioPage from './pages/PortfolioPage';
import CustomerDetail from './pages/CustomerDetail';

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
            <Route path="/customer/:id" element={<CustomerDetail />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
