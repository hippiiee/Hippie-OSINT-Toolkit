import Image from 'next/image'

interface ArticleImageProps {
  src: string
  alt: string
  width: number
  height: number
}

export function ArticleImage({ src, alt, width, height }: ArticleImageProps) {
  return (
    <div className="my-8 flex flex-col items-center">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="rounded-lg shadow-md"
      />
      <p className="mt-2 text-sm text-center text-gray-500">
        {alt}
      </p>
    </div>
  )
}