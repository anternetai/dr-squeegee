import Image from "next/image"

interface MascotDividerProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  position?: "left" | "right" | "center"
}

export function MascotDivider({
  src,
  alt,
  width,
  height,
  className = "",
  position = "right",
}: MascotDividerProps) {
  const alignment =
    position === "left"
      ? "justify-start -ml-4 md:-ml-8"
      : position === "right"
        ? "justify-end -mr-4 md:-mr-8"
        : "justify-center"

  return (
    <div className={`flex ${alignment} px-6 overflow-hidden ${className}`}>
      <div className="w-28 md:w-36">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="w-full h-auto"
          loading="lazy"
        />
      </div>
    </div>
  )
}
