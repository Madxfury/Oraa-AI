import { motion } from 'framer-motion';
import { Database, Zap, Cpu, Cloud } from 'lucide-react';

const technologies = [
    {
        icon: <Database size={24} />,
        title: 'Qwen-based Model',
        description: 'Built on the robust Qwen vision-language model architecture for superior prompt adherence.',
    },
    {
        icon: <Zap size={24} />,
        title: 'LoRA Fine-tuning',
        description: 'Low-Rank Adaptation enables fast and precise camera control without full model retraining.',
    },
    {
        icon: <Cpu size={24} />,
        title: 'Diffusion Engines',
        description: 'Advanced diffusion processes ensure photorealistic outputs and consistent geometry generation.',
    },
    {
        icon: <Cloud size={24} />,
        title: 'Cloud Inference',
        description: 'Optimized cloud deployment pipeline for rapid, scalable generation with minimal latency.',
    }
];

export function TechStack() {
    return (
        <section id="tech" className="py-24 relative bg-dark-950/50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="md:w-1/3"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Powered by <br />
                            <span className="text-accent-500 text-glow">Next-Gen Tech</span>
                        </h2>
                        <p className="text-white/50 mb-8 max-w-md text-lg">
                            Our architecture securely processes image transformations using state-of-the-art vision models. The pipeline is optimized for quality and speed.
                        </p>
                        <button className="text-primary-400 font-semibold flex items-center gap-2 hover:text-primary-300 transition-colors">
                            Read Architecture Deep-dive
                        </button>
                    </motion.div>

                    <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                        {technologies.map((tech, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="glass-panel p-6 rounded-2xl hover:border-white/20 transition-all cursor-default"
                            >
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-dark-800 border border-white/10 flex items-center justify-center text-accent-400">
                                        {tech.icon}
                                    </div>
                                    <h3 className="font-bold text-lg">{tech.title}</h3>
                                </div>
                                <p className="text-white/50 text-sm">
                                    {tech.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
