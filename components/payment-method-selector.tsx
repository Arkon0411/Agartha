"use client"
import { Button } from "@/components/ui/button"
import { QrCode, DollarSign } from "lucide-react"

interface PaymentMethodSelectorProps {
  onSelect: (method: "cash" | "qrph") => void
}

export default function PaymentMethodSelector({ onSelect }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Select Payment Method</p>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => onSelect("qrph")}
          className="h-24 flex flex-col items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-900 border-2 border-orange-300"
          variant="outline"
        >
          <QrCode className="w-8 h-8" />
          <span className="text-sm font-bold">QRPH</span>
          <span className="text-xs">Digital</span>
        </Button>

        <Button
          onClick={() => onSelect("cash")}
          className="h-24 flex flex-col items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-900 border-2 border-green-300"
          variant="outline"
        >
          <DollarSign className="w-8 h-8" />
          <span className="text-sm font-bold">Cash</span>
          <span className="text-xs">Physical</span>
        </Button>
      </div>
    </div>
  )
}
