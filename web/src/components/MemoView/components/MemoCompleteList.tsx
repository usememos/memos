import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function MemoCompleteList() {
  return (
    <section className="  flex items-center gap-3">
        <div className=" flex items-center gap-2 ">
            <span>Completed Task</span>
        <Switch
         defaultChecked
         className="  [&>[data-slot=switch-thumb][data-state=unchecked]]:bg-mauve-400 [&>[data-slot=switch-thumb][data-state=checked]]:bg-white"
         />
         </div>
        <Button  className=" not-hover:border-foreground not-hover:text-foreground bg-transparent border-2 transition-all ease-linear">Clear Completed</Button>
    </section>
  )
}

export default MemoCompleteList