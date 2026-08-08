import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useTableConfigStore } from '@/store/table-config-store'
import { HugeiconsIcon } from '@hugeicons/react'
import { Rotate01Icon, Settings01Icon } from '@hugeicons/core-free-icons'
import React from 'react'
import { toast } from "sonner"

interface ColumnConfigDialogProps {
  tableId: string
  trigger?: React.ReactNode
}

export function ColumnConfigDialog({ tableId, trigger }: ColumnConfigDialogProps) {
  const {
    tables,
    updateColumnVisibility,
    resetTableConfig,
  } = useTableConfigStore()

  const tableConfig = tables[tableId]
  const columns = tableConfig?.columns || []

  const handleColumnToggle = (columnId: string, visible: boolean) => {
    updateColumnVisibility(tableId, columnId, visible)
  }


  const currentVisibility = tableConfig?.columnVisibility || {}

  const handleReset = () => {
    resetTableConfig(tableId)
    toast.success("Column configuration reset successfully" as any)
  }

  const defaultTrigger = (
    <Button variant="secondary" className="w-[180px] h-10 font-normal">
      <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4 mr-2" strokeWidth={2} color="currentColor" />
      Configuration
    </Button>
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
                                           <DialogTitle>{"Column Configuration" as any}</DialogTitle>
          <DialogDescription>
                                                   {"Configure which columns to show or hide in the table" as any}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            {columns.map((column) => (
              <div key={column.id} className="flex items-center space-x-2">
                <Checkbox
                  id={column.id}
                  checked={currentVisibility[column.id] !== false}
                  onCheckedChange={(checked) => 
                    handleColumnToggle(column.id, checked as boolean)
                  }
                />
                <label
                  htmlFor={column.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {column.title}
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" className="w-[180px] h-10">
                <HugeiconsIcon icon={Rotate01Icon} className="h-4 w-4 mr-2" strokeWidth={2} color="currentColor" />
                                                                   {"Reset to Default" as any}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                                                                           {"Reset Table Configuration" as any}
                </AlertDialogTitle>
                <AlertDialogDescription>
                                                                           {"Are you sure you want to reset the table configuration to default settings?" as any}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{"Cancel"}</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                                                                           {"Reset" as any}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  )
} 