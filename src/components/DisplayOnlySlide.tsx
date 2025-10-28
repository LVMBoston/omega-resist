import { DisplayOnlyConfig } from "@/types/viralTemplates";

interface DisplayOnlySlideProps {
  imageUrl: string;
  config: DisplayOnlyConfig;
}

export const DisplayOnlySlide = ({ imageUrl, config }: DisplayOnlySlideProps) => {
  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <img
        src={imageUrl}
        alt="Display slide"
        className="max-w-full max-h-full object-contain"
      />
      {/* No overlay, no hotspots - just pure display */}
    </div>
  );
};
