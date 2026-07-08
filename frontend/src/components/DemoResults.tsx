import { motion } from 'framer-motion';

const demoPairs = [
    {
        title: 'Low Angle to Eye Level',
        before: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?q=80&w=800&auto=format&fit=crop',
        after: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?q=80&w=800&auto=format&fit=crop', // Placeholder
        settings: 'Angle +45°',
    },
    {
        title: 'Zoom Out & Rotate',
        before: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop',
        after: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop', // Placeholder
        settings: 'Zoom 60%, Rot -15°',
    }
];

export function DemoResults() {
    return (
        <section className="py-24 relative bg-dark-900 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">
                        Stunning <span className="text-primary-400">Results</span>
                    </h2>
                    <p className="text-white/50 max-w-2xl mx-auto text-lg">
                        Hover over the images to see the transformation applied by the LoRA camera controls.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {demoPairs.map((pair, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-dark-950 border border-white/10"
                        >
                            {/* After image - usually hidden, shown on hover */}
                            <img
                                src={pair.after}
                                alt={`${pair.title} After`}
                                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
                            />

                            {/* Before image */}
                            <img
                                src={pair.before}
                                alt={`${pair.title} Before`}
                                className="absolute inset-0 w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-500 z-0"
                            />

                            {/* Labels */}
                            <div className="absolute top-4 left-4 z-20 flex gap-2">
                                <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-semibold text-white/80 border border-white/10 group-hover:opacity-0 transition-opacity">
                                    Before
                                </span>
                                <span className="px-3 py-1 bg-primary-500/80 backdrop-blur-md rounded-lg text-xs font-semibold text-white border border-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    After
                                </span>
                            </div>

                            {/* Info Overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                <h3 className="text-lg font-bold text-white mb-1">{pair.title}</h3>
                                <p className="text-sm text-primary-400 font-medium">{pair.settings}</p>
                            </div>

                            {/* Divider Line on Hover - optional aesthetic touch */}
                            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/20 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
