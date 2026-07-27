import { DotLottieReact } from "@lottiefiles/dotlottie-react"

type Props = {
  animationData: object
  className?: string
}

export default function LottiePlayer({ animationData, className = "" }: Props) {
  return (
    <div
      className={`${className} transition-colors duration-200 ease-in-out dark:rounded-full dark:bg-zinc-100`}
    >
      <DotLottieReact data={animationData} loop autoplay />
    </div>
  )
}
