<<<<<<< HEAD
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AlertCircle, Brush } from "lucide-react";
import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Props {
  name:string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onSavePreferences?: (colors: { bgColor: string; textColor: string }) => Promise<void> | void;
}
const MIN_CONTRAST_RATIO = 4.5;

const parseHexColor = (hex: string) => {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return { r, g, b };
};

const relativeLuminance = (hex: string) => {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return null;
  }

  const transform = (channel: number) => {
    const sRgb = channel / 255;
    return sRgb <= 0.03928 ? sRgb / 12.92 : Math.pow((sRgb + 0.055) / 1.055, 2.4);
  };

  const r = transform(rgb.r);
  const g = transform(rgb.g);
  const b = transform(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrastRatio = (foreground: string, background: string) => {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);

  if (l1 == null || l2 == null) {
    return null;
  }

  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);

  return (light + 0.05) / (dark + 0.05);
};

function MemoCustomizeColor(props: Props) {
  const { className, onOpenChange, onSavePreferences,name } = props;
  const [open, setOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#121212");
=======
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils";
import { Brush } from "lucide-react"
import { useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Props {
//   memo: Memo;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

function MemoCustomizeColor(props:Props) {
const {className,onOpenChange} = props;
const [open, setOpen] = useState(false);
 const [bgColor, setBgColor] = useState("#121212");
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);

<<<<<<< HEAD
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(name);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as {
        bgColor?: string;
        textColor?: string;
      };

      if (parsed.bgColor) {
        setBgColor(parsed.bgColor);
      }
      if (parsed.textColor) {
        setTextColor(parsed.textColor);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load memo color preferences", error);
    }
  }, [name]);

=======
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
  const bgPresets = ["#121212", "#2c2f33", "#1d3557", "#2d6a4f", "#601010", "#000000"];
  const textPresets = ["#FFFFFF", "#E1E8ED", "#89CFF0", "#C7F9CC", "#FEFAE0", "#FAD2E1"];

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };
<<<<<<< HEAD

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const handleSave = async () => {
    try {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            name,
            JSON.stringify({
              bgColor,
              textColor,
            }),
          );

          window.dispatchEvent(
            new CustomEvent("memo-colors-changed", {
              detail: {
                key: name,
                colors: {
                  bgColor,
                  textColor,
                },
              },
            }),
          );
        } catch {
          // Ignore write errors
        }
      }

      if (onSavePreferences) {
        await onSavePreferences({
          bgColor,
          textColor,
        });
      }
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to save memo color preferences", error);
    }
  };

  const contrastRatio = getContrastRatio(textColor, bgColor);
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            "h-7 w-7 flex justify-center items-center rounded-full border cursor-pointer transition-all hover:opacity-80",
            className,
          )}
        >
          <Brush className="w-4 h-4 mx-auto" />
        </span>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        className="max-w-[90vw] sm:max-w-md data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
=======
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <span
                  className={cn(
                    "h-7 w-7 flex justify-center items-center rounded-full border cursor-pointer transition-all hover:opacity-80",
                    className,
                  )}
                >
                  <Brush className="w-4 h-4 mx-auto text-muted-foreground" />
                </span>



                
              </PopoverTrigger>


        <PopoverContent align="start" className="max-w-[90vw] sm:max-w-md  ">
           <div className="flex items-center justify-center ">
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white text-lg font-semibold">Tweet Style Customization</h2>
        </div>

        {/* Live Preview */}
        <div className="p-6">
          <div 
            className="p-4 rounded-xl border border-gray-700 mb-6 transition-colors duration-200"
            style={{ backgroundColor: bgColor }}
          >
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>31 minutes ago</span>
              <div className="flex gap-2">🎨 ⚙️ ︙</div>
            </div>
            <p className="text-xl font-bold mb-4" style={{ color: textColor }}>
<<<<<<< HEAD
              Content Should be here...
=======
              EL DONIA DH BTA3TIIIIIIIIII
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
            </p>
            <div className="flex gap-2">
              <span className="bg-gray-800/50 p-1 px-3 rounded-full text-xs">👍 1</span>
              <span className="bg-gray-800/50 p-1 px-3 rounded-full text-xs">❤️ 1</span>
            </div>
<<<<<<< HEAD
            {contrastRatio != null && contrastRatio < MIN_CONTRAST_RATIO && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3 h-3" />
                <span>Low contrast may affect readability.</span>
              </div>
            )}
=======
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
          </div>

          {/* Background Color Section */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm block mb-3">Background Color</label>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {bgPresets.map((color) => (
                <button
                  key={color}
                  onClick={() => setBgColor(color)}
                  className={`h-10 rounded border-2 ${bgColor === color ? 'border-blue-500' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="relative">
               <input 
                 className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm cursor-pointer"
                 value={bgColor.toUpperCase()}
                 onClick={() => setShowBgPicker(!showBgPicker)}
                 readOnly
               />   
               {showBgPicker && (
                 <div className="absolute z-10 mt-2 bg-gray-800 p-2 rounded shadow-xl">
                   <HexColorPicker color={bgColor} onChange={setBgColor} />
                 </div>
               )}
            </div>
          </div>

          {/* Text Color Section */}
          <div className="mb-8">
            <label className="text-gray-400 text-sm block mb-3">Text Color</label>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {textPresets.map((color) => (
                <button
                  key={color}
                  onClick={() => setTextColor(color)}
                  className={`h-10 rounded border-2 ${textColor === color ? 'border-blue-500' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="relative ">
               <input 
                 className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm cursor-pointer"
                 value={textColor.toUpperCase()}
                 onClick={() => setShowTextPicker(!showTextPicker)}
                 readOnly
               />
               {showTextPicker && (
                 <div className="absolute z-10 -top-15 bg-gray-800 p-2 rounded shadow-xl">
                   <HexColorPicker color={textColor} onChange={setTextColor} />
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 bg-black/20 border-t border-gray-800">
<<<<<<< HEAD
          <button
            type="button"
            className="text-gray-400 hover:text-white px-4 py-2 transition text-sm"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition text-sm"
            onClick={handleSave}
          >
=======
          <button className="text-gray-400 hover:text-white px-4 py-2 transition text-sm">Cancel</button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition text-sm">
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
            Save Preferences
          </button>
        </div>
        </div>
<<<<<<< HEAD
=======
        </div>
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
      </PopoverContent>
    </Popover>

  )
}

export default MemoCustomizeColor



