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
        <div className={className}>
            <DotLottieReact
                data={animationData}
                loop
                autoplay
            />
        </div>
    );
}