import { motion } from 'framer-motion';
import { UploadCloud, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';

const steps = [
    {
        icon: <UploadCloud size={32} />,
        title: 'Upload Image',
        description: 'Provide an initial image to be edited. The model analyzes the scene geometry and subject features.',
    },
    {
        icon: <SlidersHorizontal size={32} />,
        title: 'Apply Camera Control',
        description: 'Use our LoRA-based controls to specify desired camera angle, zoom, and rotation transformations.',
    },
    {
        icon: <ImageIcon size={32} />,
        title: 'Generate Output',
        description: 'The diffusion model generates a high-fidelity image reflecting the new perspective while preserving coherence.',
    }
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 100 },
    },
};

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 relative">
            <div className="max-w-7xl mx-auto px-6">
                <div className="mb-16 text-center">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">How it <span className="text-primary-400 text-glow">Works</span></h2>
                    <p className="text-white/50 max-w-2xl mx-auto text-lg">
                        Three simple steps to achieve fine-grained control over camera parameters in AI generated content.
                    </p>
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center relative group overflow-hidden"
                        >
                            {/* Subtle hover gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/10 group-hover:to-accent-500/10 transition-all duration-500" />

                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 mb-6 group-hover:scale-110 group-hover:text-primary-300 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                            <p className="text-white/50 text-sm leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
