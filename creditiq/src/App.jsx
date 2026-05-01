import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Upload from './pages/Upload';
import Portfolio from './pages/Portfolio';
import CustomerDetail from './pages/CustomerDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/customer" element={<CustomerDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
