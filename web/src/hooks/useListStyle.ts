import { useEffect, useState } from "react";

const useListStyle = () => {
  const initialState = localStorage.getItem("listStyle") === "true";
  const [listStyle, setListStyle] = useState(initialState);

  useEffect(() => {
    // storing input name
    localStorage.setItem("listStyle", JSON.stringify(listStyle));
  }, [listStyle]);
  return {
    listStyle,
    setToListStyle: () => {
      setListStyle(true);
    },
    setToTableStyle: () => {
      setListStyle(false);
    },
  };
};
export default useListStyle;
