import React from 'react';

interface AchievementWatermarksProps {
  achievements: {
    silverHat: boolean;
    goldJersey: boolean;
    greenJacket: boolean;
  };
}

const AchievementWatermarks: React.FC<AchievementWatermarksProps> = ({ achievements }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
      {achievements.silverHat && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src="/silver-hat.svg" 
            alt="" 
            className="absolute w-full h-full object-contain opacity-30"
            loading="lazy"
          />
        </div>
      )}
      
      {achievements.goldJersey && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src="/gold-jersey.svg" 
            alt="" 
            className="absolute w-full h-full object-contain opacity-30"
            loading="lazy"
          />
        </div>
      )}
      
      {achievements.greenJacket && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src="/green-jacket.svg" 
            alt="" 
            className="absolute w-full h-full object-contain opacity-30"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

export default AchievementWatermarks;