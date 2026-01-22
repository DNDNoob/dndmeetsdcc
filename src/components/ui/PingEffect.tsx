import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Ping {
  id: string;
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
  color: string;
  timestamp: number;
}

interface PingEffectProps {
  pings: Ping[];
}

export const PingEffect: React.FC<PingEffectProps> = ({ pings }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {pings.map((ping) => (
          <motion.div
            key={ping.id}
            className="absolute"
            style={{
              left: `${ping.x}%`,
              top: `${ping.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
          >
            {/* Outer ripple */}
            <motion.div
              className="absolute rounded-full border-4"
              style={{
                borderColor: ping.color,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ width: 20, height: 20, opacity: 1 }}
              animate={{ width: 120, height: 120, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            {/* Middle ripple */}
            <motion.div
              className="absolute rounded-full border-4"
              style={{
                borderColor: ping.color,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ width: 20, height: 20, opacity: 1 }}
              animate={{ width: 120, height: 120, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            />
            {/* Inner ripple */}
            <motion.div
              className="absolute rounded-full border-4"
              style={{
                borderColor: ping.color,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ width: 20, height: 20, opacity: 1 }}
              animate={{ width: 120, height: 120, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
            />
            {/* Center dot */}
            <motion.div
              className="absolute w-4 h-4 rounded-full"
              style={{
                backgroundColor: ping.color,
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 10px ${ping.color}, 0 0 20px ${ping.color}`,
              }}
              initial={{ scale: 1.5, opacity: 1 }}
              animate={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PingEffect;
