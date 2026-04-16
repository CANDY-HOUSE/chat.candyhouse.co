import React, { useEffect, useState } from 'react'
import { PhotoSlider } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'

interface Props {
  srcs?: Array<string>
  index?: number
}

const ImagePreview: React.FC<Props> = ({ srcs, index }) => {
  const [visibleLocal, setVisibleLocal] = useState(() => Boolean(srcs && srcs.length > 0))
  const [indexLocal, setIndexLocal] = useState(index)

  useEffect(() => {
    setVisibleLocal(Boolean(srcs && srcs.length > 0))
    setIndexLocal(index)
  }, [srcs, index])

  return (
    <PhotoSlider
      images={srcs?.map((item) => ({ src: item, key: item })) || []}
      visible={visibleLocal}
      index={indexLocal}
      onClose={() => setVisibleLocal(false)}
      onIndexChange={setIndexLocal}
    />
  )
}

export default ImagePreview
