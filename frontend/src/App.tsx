import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { EditorLayout } from './components/EditorLayout';
import './App.css';

function App() {
  // Normal scroll behavior active by default

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-primary-500/30 selection:text-white relative">
      {/* Noise Granular Overlay for Cinematic Feel */}
      <div
        className="fixed inset-0 z-[999] pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}
      ></div>

      <Navbar />

      <main className="pt-16 pb-12 max-w-[1400px] mx-auto px-4 md:px-8 relative z-10">
        <EditorLayout />
      </main>

      <Footer />
    </div>
  );
}

export default App;
