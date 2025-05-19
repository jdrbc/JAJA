import React from 'react';

interface SectionTitleProps {
  title: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ title }) => {
  return (
    <div className='flex items-center mb-2'>
      <h2 className='text-xl font-semibold'>{title}</h2>
    </div>
  );
};

export default SectionTitle;
