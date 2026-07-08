import React from 'react';
import { Camera, Download } from 'lucide-react';

interface ComparisonViewProps {
    inputImage: string | null;
    outputImage: string | null;
    isLoading: boolean;
    prompt?: string;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ inputImage, outputImage, isLoading, prompt }) => {
    if (!inputImage) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full">
                <div className="w-20 h-20 bg-dark-800 rounded-full flex items-center justify-center mb-6 border border-dark-700">
                    <Camera className="w-10 h-10 opacity-50" />
                </div>
                <h3 className="text-xl font-medium text-gray-300 mb-2">Start Creating</h3>
                <p className="max-w-md text-center">Upload an image from the sidebar and adjust the camera angle to generate a new perspective.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                {/* Input Preview (Small / Reference) */}
                {/* Only show if we have output, otherwise show it large? 
            Actually, better to show split view always if input exists. 
            Or maybe 50/50. 
        */}
                <div className="flex-1 bg-dark-800 border border-dark-700 rounded-xl overflow-hidden relative group">
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-medium text-white z-10">Input Data</div>
                    <img src={inputImage} alt="Input" className="w-full h-full object-contain bg-checkered" />
                </div>

                {/* Output Preview */}
                <div className="flex-1 bg-dark-800 border border-dark-700 rounded-xl overflow-hidden relative group flex items-center justify-center">
                    <div className="absolute top-3 left-3 bg-primary-600/80 backdrop-blur px-2 py-1 rounded text-xs font-medium text-white z-10">AI Generated</div>

                    {isLoading ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                            <span className="text-sm text-primary-400 animate-pulse">Generating new angle...</span>
                        </div>
                    ) : outputImage ? (
                        <>
                            <img src={outputImage} alt="Output" className="w-full h-full object-contain bg-checkered" />
                            <button className="absolute bottom-4 right-4 p-2 bg-dark-900/80 hover:bg-primary-600 rounded-lg text-white transition opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-white/10">
                                <Download className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <div className="text-gray-500 text-sm">
                            Waiting for generation...
                        </div>
                    )}
                </div>
            </div>

            {/* Prompt Display */}
            {outputImage && prompt && (
                <div className="mt-4 p-4 bg-dark-800 border border-dark-700 rounded-lg">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Generated Prompt</h4>
                    <p className="text-sm text-gray-200 font-mono">{prompt}</p>
                </div>
            )}
        </div>
    );
};
