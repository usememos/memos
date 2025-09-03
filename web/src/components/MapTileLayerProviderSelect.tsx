import { ExternalLinkIcon, Settings2Icon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslate } from "@/utils/i18n";

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

// 内置地图模板配置
const BUILTIN_TEMPLATES = {
  openstreetmap: {
    name: "OpenStreetMap",
    url: "",
    wiki: "https://wiki.openstreetmap.org/wiki/Tiles",
    requiresToken: false,
  },
  cartodb: {
    name: "CartoDB",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    wiki: "https://carto.com/help/building-maps/basemap-list/",
    requiresToken: false,
  },
  google: {
    name: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key={your_token}",
    wiki: "https://developers.google.com/maps/documentation/tile/overview",
    requiresToken: true,
  },
  apple: {
    name: "Apple Maps",
    url: "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
    wiki: "https://developer.apple.com/maps/",
    requiresToken: true,
  },
  bing: {
    name: "Bing Maps",
    url: "https://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1&key={your_token}",
    wiki: "https://docs.microsoft.com/en-us/bingmaps/rest-services/imagery/get-imagery-metadata",
    requiresToken: true,
  },
  mapbox: {
    name: "Mapbox",
    url: "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token={your_token}",
    wiki: "https://docs.mapbox.com/api/maps/",
    requiresToken: true,
  },
};

const MapTileLayerProviderSelect = (props: Props) => {
  const { value, onValueChange, className } = props;
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslate();

  const handleEditClick = () => {
    setIsCustomDialogOpen(true);
  };

  const handleCustomUrlSubmit = () => {
    onValueChange(customUrl.trim());
    setIsCustomDialogOpen(false);
    setCustomUrl("");
    setSelectedTemplate("");
  };

  const handleTemplateSelect = (templateKey: string) => {
    const template = BUILTIN_TEMPLATES[templateKey as keyof typeof BUILTIN_TEMPLATES];
    if (template) {
      setCustomUrl(template.url);
      setSelectedTemplate(templateKey);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setCustomUrl(newValue);

    // If user manually modifies the URL, clear the template selection
    if (selectedTemplate) {
      const template = BUILTIN_TEMPLATES[selectedTemplate as keyof typeof BUILTIN_TEMPLATES];
      if (template && newValue !== template.url) {
        setSelectedTemplate("");
      }
    }
  };

  // Auto-resize input based on content
  useEffect(() => {
    if (inputRef.current) {
      const input = inputRef.current;
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    }
  }, [customUrl]);

  const getDisplayName = () => {
    if (value === "") return "OpenStreetMap";
    if (Object.keys(BUILTIN_TEMPLATES).includes(value)) {
      const template = BUILTIN_TEMPLATES[value as keyof typeof BUILTIN_TEMPLATES];
      return template ? template.name : "Custom";
    }
    return "Custom";
  };

  return (
    <>
      <Button variant="outline" onClick={handleEditClick} className={className || "min-w-fit justify-between"}>
        <span>{getDisplayName()}</span>
        <Settings2Icon className="h-4 w-4 ml-2" />
      </Button>

      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("setting.preference-section.map-config.title")}</DialogTitle>
            <DialogDescription>{t("setting.preference-section.map-config.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label>{t("setting.preference-section.map-config.quick-templates")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(BUILTIN_TEMPLATES).map(([key, template]) => (
                  <Button
                    key={key}
                    variant={selectedTemplate === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTemplateSelect(key)}
                    className="justify-start text-left h-auto py-3 px-3"
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{template.name}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(template.wiki, "_blank");
                          }}
                        >
                          <ExternalLinkIcon className="h-3 w-3" />
                        </Button>
                      </div>
                      {template.requiresToken && (
                        <div className="text-xs text-orange-600 mt-1">{t("setting.preference-section.map-config.requires-api-key")}</div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="custom-url">{t("setting.preference-section.map-config.tile-server-url")}</Label>
              <Textarea
                id="custom-url"
                placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                value={customUrl}
                onChange={handleUrlChange}
                className="mt-2 min-h-[40px] resize-none"
                ref={inputRef}
              />
            </div>

            <div className="bg-muted p-3 rounded-md">
              <h4 className="font-medium mb-2">{t("setting.preference-section.map-config.parameters")}</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>
                  <code className="bg-background px-1 rounded">{"{z}"}</code> {t("setting.preference-section.map-config.zoom-level")}
                </li>
                <li>
                  <code className="bg-background px-1 rounded">{"{x}"}</code> {t("setting.preference-section.map-config.tile-x-coordinate")}
                </li>
                <li>
                  <code className="bg-background px-1 rounded">{"{y}"}</code> {t("setting.preference-section.map-config.tile-y-coordinate")}
                </li>
                <li>
                  <code className="bg-background px-1 rounded">{"{s}"}</code> {t("setting.preference-section.map-config.subdomain")}
                </li>
                <li>
                  <code className="bg-background px-1 rounded">{"{r}"}</code> {t("setting.preference-section.map-config.retina-resolution")}
                </li>
                <li>
                  <code className="bg-background px-1 rounded">{"{your_token}"}</code>{" "}
                  {t("setting.preference-section.map-config.api-token-placeholder")}
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCustomUrlSubmit}>{t("setting.preference-section.map-config.apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapTileLayerProviderSelect;
