import React from 'react';
import MobileHeader from "@/components/MobileHeader";

const Tourism = () => {
  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-black dark:text-gray-300">
          <h1 className="text-2xl font-bold">Tourism</h1>
          <p className="text-base">Explore the beauty and attractions of various destinations.</p>
        </div>
      </div>
    </section>
  );
};

export default Tourism;
