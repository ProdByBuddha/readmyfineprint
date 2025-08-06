// Test file to verify shadcn/ui components can be imported correctly
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu } from "@/components/ui/dropdown-menu"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs } from "@/components/ui/tabs"
import { Toast } from "@/components/ui/toast"

// Test component to verify all imports work
export default function TestShadcnImports() {
  return (
    <div>
      <h1>Testing shadcn/ui imports</h1>
      <p>If this file compiles without errors, all imports are working correctly.</p>
    </div>
  )
}