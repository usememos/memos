import { PenLineIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useMobileDrawer } from "@/contexts/MobileDrawerContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

const FloatingNewMemoButton = () => {
  const navigate = useNavigate();
  const { clearAllFilters } = useMemoFilterContext();
  const { isDrawerOpen } = useMobileDrawer();
  const currentUser = useCurrentUser();

  if (!currentUser) return null;

  const handleClick = () => {
    clearAllFilters();
    navigate("/");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="New memo"
      className={cn(
        // z-30 keeps button above regular content but below:
        // - Focus Mode backdrop (z-40)
        // - Radix modals/sheets/dialogs (z-50)
        "fixed bottom-6 right-6 z-30",
        "flex items-center justify-center",
        "w-14 h-14 rounded-full shadow-lg",
        "bg-primary text-primary-foreground",
        "hover:opacity-90 active:scale-95 transition-all duration-150",
        isDrawerOpen && "opacity-0 pointer-events-none",
      )}
    >
      <PenLineIcon className="w-6 h-6" />
    </button>
  );
};

export default FloatingNewMemoButton;
