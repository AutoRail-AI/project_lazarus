"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function ManageSubscriptionButton() {
    const [loading, setLoading] = useState(false)

    const handleClick = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/billing/portal", { method: "POST" })
            const data = (await res.json()) as { url?: string; error?: string }
            if (data.url) {
                window.location.href = data.url
            } else {
                console.error("Portal error:", data.error)
            }
        } catch (error) {
            console.error("Portal error:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="pt-4">
            <Button
                size="sm"
                variant="outline"
                onClick={handleClick}
                disabled={loading}
            >
                {loading ? (
                    <>
                        <Spinner className="mr-2 h-3.5 w-3.5" />
                        Loading...
                    </>
                ) : (
                    "Manage Subscription"
                )}
            </Button>
        </div>
    )
}
