import React from "react";
import { Card } from "../ui/card";

type CardBoxProps = React.ComponentProps<"div"> & {
  children: React.ReactNode;
};

const CardBox: React.FC<CardBoxProps> = ({ children, className, ...props }) => {
  return (
    <Card
      className={`card no-inset no-ring ${className} shadow-none border border-ld rounded-lg w-full`}
      {...props}
    >
      {children}
    </Card>
  );

};
export default CardBox;
