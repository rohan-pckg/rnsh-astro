import { DotLottieReact } from "@lottiefiles/dotlottie-react"

type Props = {
  animationData: object
  className?: string
}

export default function LottiePlayer({ animationData, className = "" }: Props) {
  return (
    <div
      className={`${className} transition-all duration-300 dark:rounded-full dark:bg-zinc-100`}
    >
      <DotLottieReact data={animationData} loop autoplay />
    </div>
  )
}
