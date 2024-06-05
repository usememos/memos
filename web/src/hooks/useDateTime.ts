import { useState } from "react";

const useDateTime = (initalState?: Date) => {
  const [dateTime, setDateTimeInternal] = useState<Date | undefined>(initalState && new Date(initalState));

  return {
    setDateTime: (dateTimeString: string) => setDateTimeInternal(new Date(dateTimeString)),
    displayDateTime: dateTime && dateTime.toLocaleString(),
    datePickerDateTime: dateTime && new Date(dateTime.getTime() - dateTime.getTimezoneOffset() * 60000).toISOString().split(".")[0],
  };
};

export default useDateTime;
