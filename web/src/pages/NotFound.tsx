import MobileHeader from "@/components/MobileHeader";

const NotFound = () => {
  return (
    <section
      id="not-found"
      className="@container w-full max-w-5xl min-h-[100svh] flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8"
    >
      <MobileHeader />
      <div className="w-full px-4 grow flex flex-col justify-center items-center sm:px-6">
        <p className="font-medium">{"The page you are looking for can't be found."}</p>
        <p className="mt-4 text-[8rem] font-mono dark:text-gray-300">404</p>
      </div>
    </section>
  );
};

export default NotFound;
