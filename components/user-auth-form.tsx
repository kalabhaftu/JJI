"use client"

import { Spinner } from '@/components/ui/spinner'

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { signInWithDiscord, signInWithEmail, verifyOtp, signInWithGoogle } from "@/server/auth"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Mail, ArrowLeft, RefreshCw } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator
} from "@/components/ui/input-otp"

const formSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

const otpFormSchema = z.object({
    otp: z.string().length(6, "Verification code must be 6 digits"),
})


interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> { }

type AuthMethod = 'email' | 'discord' | 'google' | null

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isEmailSent, setIsEmailSent] = React.useState<boolean>(false)
    const [countdown, setCountdown] = React.useState<number>(0)
    const [authMethod, setAuthMethod] = React.useState<AuthMethod>(null)
    const [showOtpInput, setShowOtpInput] = React.useState<boolean>(false)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [otpError, setOtpError] = React.useState<boolean>(false)
    const router = useRouter()

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const next = urlParams.get('next')
        setNextUrl(next)
    }, [])

    React.useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    })

    const otpForm = useForm<z.infer<typeof otpFormSchema>>({
        resolver: zodResolver(otpFormSchema),
        defaultValues: {
            otp: "",
        },
    })

    // Track verification attempts
    const [isVerifying, setIsVerifying] = React.useState(false)
    const [failedAttempts, setFailedAttempts] = React.useState(0)
    const [isRateLimited, setIsRateLimited] = React.useState(false)
    const verificationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    const onSubmitOtp = React.useCallback(async (values: z.infer<typeof otpFormSchema>) => {
        if (isVerifying || isLoading || isRateLimited) return

        setIsVerifying(true)
        setIsLoading(true)
        setOtpError(false)

        try {
            const email = form.getValues('email')
            await verifyOtp(email, values.otp)

            setFailedAttempts(0)
            setIsRateLimited(false)

            toast.success("Verified successfully", {
                description: "Redirecting you to the dashboard...",
            })
            router.refresh()
            router.push((nextUrl || '/dashboard') as Route)
        } catch (error) {
            setFailedAttempts(prev => prev + 1)
            setOtpError(true)
            otpForm.setValue('otp', '')

            const errorMessage = error instanceof Error ? error.message : "Verification failed"

            if (errorMessage.includes('rate limit')) {
                setIsRateLimited(true)
                toast.error("Too Many Attempts", { description: "Please wait before trying again." })
                setTimeout(() => setIsRateLimited(false), 30000)
            } else {
                toast.error("Verification Failed", { description: "Invalid code. Please try again." })
            }
        } finally {
            setIsLoading(false)
            setIsVerifying(false)
        }
    }, [form, otpForm, router, nextUrl, isVerifying, isLoading, isRateLimited])

    // Auto-verify on 6 digits
    React.useEffect(() => {
        const subscription = otpForm.watch((value, { name }) => {
            if (name !== 'otp') return
            const otpValue = value.otp

            if (otpValue?.length === 6 && !isLoading && !isVerifying && !isRateLimited) {
                if (verificationTimeoutRef.current) clearTimeout(verificationTimeoutRef.current)
                verificationTimeoutRef.current = setTimeout(() => {
                    onSubmitOtp({ otp: otpValue })
                }, 300)
            }
        })
        return () => subscription.unsubscribe()
    }, [otpForm, isLoading, isVerifying, isRateLimited, onSubmitOtp])


    async function onSubmitEmail(values: z.infer<typeof formSchema>) {
        if (countdown > 0) return

        setIsLoading(true)
        setAuthMethod('email')
        try {
            const result = await signInWithEmail(values.email, nextUrl)

            if (result.error) {
                toast.error("Error", { description: result.error })
                return
            }

            setIsEmailSent(true)
            setShowOtpInput(true)
            setCountdown(30)
            toast.success("Code sent!", { description: "Check your email for the verification code." })

        } catch (error) {
            toast.error("Error", { description: "Failed to send verification code. Please try again." })
        } finally {
            setIsLoading(false)
            setAuthMethod(null)
        }
    }

    const handleResend = async () => {
        if (countdown > 0) return
        form.handleSubmit(onSubmitEmail)()
    }

    const handleBack = () => {
        setIsEmailSent(false)
        setShowOtpInput(false)
        otpForm.reset()
        setOtpError(false)
    }

    async function onSubmitDiscord(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)
        setAuthMethod('discord')
        try {
            await signInWithDiscord(nextUrl)
        } catch (error) {
            setAuthMethod(null)
            setIsLoading(false)
        }
    }

    async function onSubmitGoogle(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)
        setAuthMethod('google')
        try {
            await signInWithGoogle(nextUrl)
        } catch (error) {
            setAuthMethod(null)
            setIsLoading(false)
        }
    }

    if (!showOtpInput) {
        return (
            <div className={cn("grid gap-6", className)} {...props}>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitEmail)} className="grid gap-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            id="email"
                                            placeholder="name@example.com"
                                            type="email"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            autoCorrect="off"
                                            disabled={isLoading}
                                            className="h-11 bg-background/50 border-input/50 focus:bg-background transition-all"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button disabled={isLoading} className="h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all">
                            {isLoading && authMethod === 'email' && (
                                <Spinner className="mr-2 h-4 w-4" />
                            )}
                            Send Verification Code
                        </Button>
                    </form>
                </Form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            Or continue with
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        type="button"
                        disabled={isLoading}
                        onClick={onSubmitGoogle}
                        className="h-11 bg-background/50 border-input/50 hover:bg-muted/50 transition-all hover:scale-[1.02]"
                    >
                        {isLoading && authMethod === 'google' ? (
                            <Spinner className="mr-2 h-4 w-4" />
                        ) : (
                            <Icons.google className="mr-2 h-4 w-4" />
                        )}
                        Google
                    </Button>
                    <Button
                        variant="outline"
                        type="button"
                        disabled={isLoading}
                        onClick={onSubmitDiscord}
                        className="h-11 bg-background/50 border-input/50 hover:bg-muted/50 transition-all hover:scale-[1.02]"
                    >
                        {isLoading && authMethod === 'discord' ? (
                            <Spinner className="mr-2 h-4 w-4" />
                        ) : (
                            <Icons.discord className="mr-2 h-4 w-4" />
                        )}
                        Discord
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("space-y-6", className)} {...props}>
            <div className="space-y-2 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Check your email</h3>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    We sent a verification code to <span className="font-medium text-foreground">{form.getValues('email')}</span>
                </p>
            </div>

            <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(onSubmitOtp)} className="space-y-6">
                    <FormField
                        control={otpForm.control}
                        name="otp"
                        render={({ field }) => (
                            <FormItem className="flex justify-center">
                                <FormControl>
                                    <InputOTP
                                        maxLength={6}
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isLoading || isVerifying}
                                        className={cn(otpError && "animate-shake")}
                                    >
                                        <InputOTPGroup className="gap-2">
                                            <InputOTPSlot index={0} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                            <InputOTPSlot index={1} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                            <InputOTPSlot index={2} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                            <InputOTPSlot index={3} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                            <InputOTPSlot index={4} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                            <InputOTPSlot index={5} className="h-12 w-10 text-lg border border-input/60 rounded-md" />
                                        </InputOTPGroup>
                                    </InputOTP>
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <div className="flex flex-col gap-2">
                        <Button
                            type="submit"
                            disabled={isLoading || isVerifying || otpForm.getValues('otp').length !== 6}
                            className="w-full h-11"
                        >
                            {isLoading || isVerifying ? (
                                <>
                                    <Spinner className="mr-2 h-4 w-4" />
                                    Verifying...
                                </>
                            ) : "Verify Code"}
                        </Button>

                        <div className="flex items-center justify-between text-sm pt-2">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="h-3 w-3 mr-1" />
                                Change Email
                            </button>

                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={countdown > 0}
                                className={cn(
                                    "flex items-center transition-colors",
                                    countdown > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:text-primary/80"
                                )}
                            >
                                {countdown > 0 ? (
                                    <>Resend in {countdown}s</>
                                ) : (
                                    <>
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Resend Code
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    )
}