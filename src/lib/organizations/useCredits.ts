"use client";
import useOrganization from "./useOrganization";

const useCredits = () => {
  const { organization, isLoading, error, mutate } = useOrganization();
  return {
    credits: organization?.credits,
    isLoading,
    error,
    mutate,
  };
};

export default useCredits;
