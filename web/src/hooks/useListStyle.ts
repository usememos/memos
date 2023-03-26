import { useState } from "react";

const useListStyle = () => {
  // true is Table Style, false is Grid Style
  const [listStyle, setListStyle] = useState(false);

  return {
    listStyle: listStyle,
    setToTableStyle: () => {
      setListStyle(true);
    },
    setToGridStyle: () => {
      setListStyle(false);
    },
  };
};
export default useListStyle;
