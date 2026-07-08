import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';

export function Navbar() {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);

    const blur = useTransform(scrollY, [0, 50], [0, 24]);
    const bgOpacity = useTransform(scrollY, [0, 50], [0, 0.7]);
    const borderOpacity = useTransform(scrollY, [0, 50], [0, 0.08]);

    useEffect(() => {
        return scrollY.onChange((latest) => setIsScrolled(latest > 20));
    }, [scrollY]);

    return (
        <motion.header
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
                backdropFilter: `blur(${blur.get()}px)`,
                backgroundColor: `rgba(0,0,0,${bgOpacity.get()})`,
                borderColor: `rgba(255,255,255,${borderOpacity.get()})`
            }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${isScrolled ? 'py-4' : 'py-6 border-transparent'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {/* Professional AI logo mark */}
                    <img src="/logo.png" alt="Oraa AI Logo" className="w-9 h-9 object-contain" />
                    <span className="font-heading font-bold text-2xl tracking-tighter text-white cursor-pointer">
                        Oraa <span className="text-emerald-400 ml-0.5">AI</span>
                    </span>
                </div>

                <nav className="hidden md:flex flex-1 justify-center items-center gap-10">
                    <a
                        href="https://github.com/Madxfury/Oraa-AI"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative text-sm font-medium text-white/50 hover:text-white transition-colors group py-2"
                    >
                        How it Works
                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-white scale-x-0 origin-right transition-transform duration-300 group-hover:scale-x-100 group-hover:origin-left" />
                    </a>
                    <a
                        href="https://huggingface.co/blog/kelseye/qwen-image-edit-2511-icedit-lora"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative text-sm font-medium text-white/50 hover:text-white transition-colors group py-2"
                    >
                        Technology
                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-white scale-x-0 origin-right transition-transform duration-300 group-hover:scale-x-100 group-hover:origin-left" />
                    </a>
                    <a
                        href="https://www.linkedin.com/in/sanskarparab/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative text-sm font-medium text-white/50 hover:text-white transition-colors group py-2"
                    >
                        Contact
                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-white scale-x-0 origin-right transition-transform duration-300 group-hover:scale-x-100 group-hover:origin-left" />
                    </a>
                </nav>

                <div className="flex items-center gap-6">
                    <a
                        href="https://github.com/Madxfury"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white transition-colors hidden sm:flex"
                    >
                        <Github size={16} />
                        GitHub
                    </a>
                    <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                        Get Hugging Face Token
                    </a>
                </div>
            </div>
        </motion.header>
    );
}
