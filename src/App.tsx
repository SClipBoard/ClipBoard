import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import Settings from "@/pages/Settings";
import Manage from "@/pages/Manage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/other" element={<div className="max-w-4xl mx-auto px-4 py-8 text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}
