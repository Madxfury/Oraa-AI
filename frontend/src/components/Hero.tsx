import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Hero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col justify-center pt-32 pb-20 overflow-hidden">
            {/* Background glowing orbs */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.15, 0.3, 0.15],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary-600/20 rounded-full blur-[120px] -z-10 pointer-events-none mix-blend-screen"
            />
            <motion.div
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.1, 0.2, 0.1],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-500/20 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-screen"
            />

            <div className="max-w-7xl mx-auto px-6 text-center z-10">
                <div className="max-w-4xl mx-auto flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-white/80 text-sm font-medium mb-8 backdrop-blur-xl shadow-inner"
                    >
                        <Sparkles size={16} className="text-primary-400" />
                        <span className="tracking-wide uppercase text-[11px] font-bold text-white/90">Introducing next-gen perspective control</span>
                    </motion.div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 leading-[1.1]">
                        <motion.span
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="block text-white"
                        >
                            AI Image Editing
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-blue-400 to-accent-500 text-glow mt-2"
                        >
                            Camera Mastery.
                        </motion.span>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.4 }}
                        className="text-lg md:text-xl text-white/40 mb-12 max-w-2xl mx-auto font-light leading-relaxed"
                    >
                        Fine-grained camera control using LoRA-based image editing. Shift perspectives seamlessly while maintaining subject consistency and perfect photorealism.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto"
                    >
                        <button className="group relative w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]">
                            <span className="relative z-10 flex items-center gap-2">
                                Try the Demo <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 ease-out group-hover:scale-100 group-hover:bg-white/90 z-0"></div>
                        </button>

                        <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/20 text-white/80 rounded-full font-semibold text-[15px] hover:bg-white/5 hover:text-white transition-all hover:border-white/40 text-center">
                            Read the Paper
                        </a>
                    </motion.div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-semibold">Scroll</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent"></div>
            </motion.div>
        </section>
    );
}
