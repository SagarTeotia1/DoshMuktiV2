import Image from 'next/image';

interface ImageSet {
  thumb: string;
  card: string;
  full: string;
}

export function DescriptionPhotos({ images }: { images: ImageSet[] }) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
      {images.map((img, i) => (
        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[#2B1B0C]/15">
          <Image src={img.card} alt="" fill className="object-cover" sizes="(max-width: 640px) 33vw, 200px" />
        </div>
      ))}
    </div>
  );
}
