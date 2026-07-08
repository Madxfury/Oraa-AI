import React, { useCallback, useState } from 'react';
import { Upload, X } from 'lucide-react';
import clsx from 'clsx';

interface ImageUploaderProps {
    onImageSelect: (file: File) => void;
    selectedImage: string | null;
    onClear: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, selectedImage, onClear }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                onImageSelect(file);
            }
        },
        [onImageSelect]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                onImageSelect(file);
            }
        },
        [onImageSelect]
    );

    if (selectedImage) {
        return (
            <div className="relative w-full h-full min-h-[300px] bg-dark-800 rounded-lg overflow-hidden border border-dark-700 flex items-center justify-center group">
                <img src={selectedImage} alt="Input" className="max-w-full max-h-full object-contain" />
                <button
                    onClick={onClear}
                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 rounded-full text-white transition opacity-0 group-hover:opacity-100"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
                'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-full min-h-[300px]',
                isDragging
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-dark-700 hover:border-primary-500 hover:bg-dark-800'
            )}
        >
            <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
            />
            <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                <div className="p-4 bg-dark-700 rounded-full mb-4 group-hover:bg-primary-500/20 group-hover:text-primary-500 transition">
                    <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg text-gray-300 font-medium">Click to upload or drag & drop</p>
                <p className="text-sm text-gray-500 mt-2">PNG or JPG (max 10MB)</p>
            </label>
        </div>
    );
};
