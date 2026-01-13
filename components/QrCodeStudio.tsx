
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Palette, ImageIcon, Download, Circle, Square, Image, X } from 'lucide-react';
import { getAssetUrl, supabase, STORAGE_BUCKET } from '../lib/supabase';
import { compressImage } from '../lib/compression';

interface QrCodeStudioProps {
    initialUrl?: string;
}

const QrCodeStudio: React.FC<QrCodeStudioProps> = ({ initialUrl = '' }) => {
    const [url, setUrl] = useState(initialUrl);
    const [fgColor, setFgColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [logoUrl, setLogoUrl] = useState('');
    const [bgImageUrl, setBgImageUrl] = useState('');
    const [shape, setShape] = useState<'square' | 'rounded' | 'circle'>('square');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if(initialUrl) setUrl(initialUrl);
    }, [initialUrl]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg') => {
        if (!e.target.files || e.target.files.length === 0) return;
        const rawFile = e.target.files[0];
        const path = `qr-assets/${Date.now()}_${rawFile.name.replace(/\s/g, '_')}`;
        setUploading(true);
        
        try {
            // Mock for demo mode
            if (path.includes('placeholder')) {
                 const mockUrl = "https://picsum.photos/200";
                 if(type === 'logo') setLogoUrl(mockUrl);
                 else setBgImageUrl(mockUrl);
                 setUploading(false);
                 return;
            }

            // COMPRESS IMAGE (Max width 800px for QR assets is plenty)
            const file = await compressImage(rawFile, 800);

            const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
            if (error) throw error;
            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            
            if(type === 'logo') setLogoUrl(data.publicUrl);
            else setBgImageUrl(data.publicUrl);

        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed. See console.");
        } finally {
            setUploading(false);
        }
    };

    const downloadQr = () => {
        const svg = document.getElementById("qr-code-studio-svg");
        
        if(svg) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const svgData = new XMLSerializer().serializeToString(svg);
            
            // Create images
            const qrImg = new window.Image();
            const bgImg = new window.Image();
            const logoImg = new window.Image();
            
            // Set canvas dimensions (high res)
            const size = 1000;
            canvas.width = size;
            canvas.height = size;

            // Chain loading
            qrImg.src = "data:image/svg+xml;base64," + btoa(svgData);
            qrImg.onload = () => {
                if(!ctx) return;

                // 1. Draw Background (Color or Image)
                ctx.save(); // Save state for clipping
                
                // Define Shape Path
                ctx.beginPath();
                if(shape === 'circle') {
                    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
                } else if (shape === 'rounded') {
                    const r = 100; // Radius for rounded rect
                    ctx.roundRect(0, 0, size, size, r);
                } else {
                    ctx.rect(0, 0, size, size);
                }
                ctx.clip(); // Clip everything to shape

                // Fill BG Color
                ctx.fillStyle = bgColor;
                ctx.fill();

                const drawContent = () => {
                    // 2. Draw QR Code
                    // Calculate QR size based on shape to fit
                    // Default padding 100px on each side for square
                    let qrSize = size - 200; 
                    
                    if (shape === 'circle') {
                        // Square must fit in circle. Diagonal = Diameter.
                        // Side = Diameter / sqrt(2). 
                        // 1000 / 1.414 = 707. 
                        // Let's use 650 for safety margin.
                        qrSize = 650;
                    }
                    
                    const qrOffset = (size - qrSize) / 2;
                    ctx.drawImage(qrImg, qrOffset, qrOffset, qrSize, qrSize);

                    // 3. Draw Center Logo
                    if (logoUrl) {
                        logoImg.crossOrigin = "anonymous";
                        logoImg.src = logoUrl;
                        logoImg.onload = () => {
                            const logoSize = size * 0.22;
                            const logoX = (size - logoSize) / 2;
                            const logoY = (size - logoSize) / 2;
                            
                            // Logo background circle (white)
                            ctx.beginPath();
                            ctx.arc(size/2, size/2, (logoSize/2) + 15, 0, Math.PI * 2);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                            
                            // Clip logo itself
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(size/2, size/2, logoSize/2, 0, Math.PI * 2);
                            ctx.clip();
                            ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                            ctx.restore(); // Restore logo clip

                            finalize();
                        };
                        logoImg.onerror = finalize;
                    } else {
                        finalize();
                    }
                };

                // Draw BG Image if exists (under QR)
                if (bgImageUrl) {
                    bgImg.crossOrigin = "anonymous";
                    bgImg.src = bgImageUrl;
                    bgImg.onload = () => {
                        const scale = Math.max(size / bgImg.width, size / bgImg.height);
                        const x = (size / 2) - (bgImg.width / 2) * scale;
                        const y = (size / 2) - (bgImg.height / 2) * scale;
                        ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
                        drawContent();
                    };
                    bgImg.onerror = drawContent;
                } else {
                    drawContent();
                }

                function finalize() {
                    ctx?.restore(); // Restore shape clip
                    const a = document.createElement("a");
                    a.download = "nmcs-qr-code.png";
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                }
            };
        }
    };

    const getContainerStyle = () => {
        switch(shape) {
            case 'circle': return 'rounded-full overflow-hidden border-4 border-white';
            case 'rounded': return 'rounded-3xl overflow-hidden border-4 border-white';
            case 'square': default: return 'rounded-none border-4 border-white';
        }
    };

    const INPUT_STYLE = "w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mini-red transition-all placeholder:text-slate-400";
    const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

    return (
        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <Palette size={20} className="text-mini-red" /> QR Code Studio
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                    <div>
                        <label className={LABEL_STYLE}>Content (URL)</label>
                        <input 
                            value={url} 
                            onChange={e => setUrl(e.target.value)} 
                            className={INPUT_STYLE} 
                            placeholder="https://..."
                        />
                    </div>
                    
                    <div>
                        <label className={LABEL_STYLE}>Shape Style</label>
                        <div className="flex gap-2">
                            <button onClick={() => setShape('square')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${shape === 'square' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                <Square size={20} /> <span className="text-xs font-bold">Square</span>
                            </button>
                            <button onClick={() => setShape('rounded')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${shape === 'rounded' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                <div className="w-5 h-5 rounded border-2 border-current"></div> <span className="text-xs font-bold">Rounded</span>
                            </button>
                            <button onClick={() => setShape('circle')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${shape === 'circle' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                <Circle size={20} /> <span className="text-xs font-bold">Circle</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_STYLE}>Foreground</label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs font-mono text-slate-500">{fgColor}</span>
                            </div>
                        </div>
                        <div>
                            <label className={LABEL_STYLE}>Background</label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs font-mono text-slate-500">{bgColor}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_STYLE}>Center Logo</label>
                            <div className="relative">
                                <label className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors h-14">
                                    {uploading ? '...' : (logoUrl ? 'Change' : 'Upload')}
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                                </label>
                                {logoUrl && <button onClick={() => setLogoUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"><X size={12}/></button>}
                            </div>
                        </div>
                        <div>
                            <label className={LABEL_STYLE}>Background Image</label>
                            <div className="relative">
                                <label className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors h-14">
                                    {uploading ? '...' : (bgImageUrl ? 'Change' : 'Upload')}
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} />
                                </label>
                                {bgImageUrl && <button onClick={() => setBgImageUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"><X size={12}/></button>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-950 p-8 rounded-2xl border border-slate-300 dark:border-slate-800">
                    <div 
                        id="qr-preview-container"
                        className={`relative p-4 shadow-2xl transition-all duration-300 flex items-center justify-center ${getContainerStyle()}`}
                        style={{
                            width: 300,
                            height: 300,
                            backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: bgImageUrl ? 'transparent' : bgColor
                        }}
                    >
                        {/* Dynamic scaling for circle shape to fit corners */}
                        <div style={{ 
                            position: 'relative', 
                            width: shape === 'circle' ? '65%' : '100%', 
                            height: shape === 'circle' ? '65%' : '100%',
                            transition: 'all 0.3s ease'
                        }}>
                            <QRCode 
                                id="qr-code-studio-svg"
                                value={url || 'https://nmcs.se'} 
                                size={256}
                                fgColor={fgColor}
                                bgColor={bgImageUrl ? 'transparent' : bgColor}
                                style={{ height: "100%", width: "100%" }}
                            />
                            {logoUrl && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-white p-1.5 rounded-full shadow-lg w-[20%] h-[20%] flex items-center justify-center overflow-hidden border-2 border-white/50">
                                        <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={downloadQr}
                        disabled={!url}
                        className="mt-8 bg-mini-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                    >
                        <Download size={18} /> Download High Res
                    </button>
                    <p className="text-[10px] text-slate-400 mt-2">Right-click image might save low-res. Use button.</p>
                </div>
            </div>
        </div>
    );
};

export default QrCodeStudio;
