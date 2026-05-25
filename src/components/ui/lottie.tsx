import { DotLottieReact } from "@lottiefiles/dotlottie-react";

type Props = {
    animationData: object;
    className?: string;
};

export default function LottiePlayer({
    animationData,
    className = "",
}: Props) {
    return (
        <div className={`${className} dark:bg-zinc-100 dark:rounded-full transition-all duration-300`}>
            <DotLottieReact
                data={animationData}
                loop
                autoplay
            />
        </div>
    );
}