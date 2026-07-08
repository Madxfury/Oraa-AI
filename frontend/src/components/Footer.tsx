import { motion } from 'framer-motion';

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-dark-950 pt-8 pb-4 mt-1">
            <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-center gap-1.5 font-heading font-bold text-2xl tracking-tight text-white mb-2 cursor-pointer">
                        <img src="/logo.png" alt="Oraa AI Logo" className="w-7 h-7 object-contain" />
                        <span>Oraa <span className="text-emerald-400 ml-0.5">AI</span></span>
                    </div>
                    <p className="text-white/50 text-sm max-w-md mx-auto">
                        Advanced Camera Angle Control using LoRA-based image editing. Built for research & demonstration purposes.
                    </p>
                </motion.div>

                <div className="flex gap-6 mb-8 text-sm text-white/40">
                    <a href="#" className="hover:text-white transition-colors">Documentation</a>
                    <a href="https://github.com/Madxfury/Oraa-AI" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub Repository</a>
                </div>

                <div className="text-white/30 text-xs flex flex-col items-center gap-1.5">
                    <div className="text-white text-sm font-medium tracking-wide">Build with ❤️‍🔥 by Sanskar</div>
                    <div>&copy; {new Date().getFullYear()} Oraa AI. All rights reserved.</div>
                </div>
            </div>
        </footer>
    );
}
