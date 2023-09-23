package com.company.RoomsNDoors;

import com.company.Base;

public class TV extends Base {
    public String object = "TV";
    public static String name = "a TV";
    public static int positionToFace=-10;
    public static int position=-10;
    public static int sectorPosition;

    public static void setPosition(int sectorPosition) {
        switch (sectorPosition) {
            case 8:
                position=31;
                break;
            case 12:
                position=32;
                break;
            case 14:
                position=33;
                break;
            case 18:
                position=34;

        }
        setFacingPosition(position);
    }

    public static void setFacingPosition(int position) {
        switch(position){
            case 31:
                positionToFace=0;
                break;
            case 32:
                positionToFace=1;
                break;
            case 33:
                positionToFace=2;
                break;
            case 34:
                positionToFace=3;
                break;
        }
    }

    public static void onTV() {
        System.out.println("TV and kitchen are out of bounds\n" +
                "WHY?, you ask,\n" +
                "complete the game for a legit explanation");
    }

    @Override
    public void printMap(int sectorPosition) {
        TV.sectorPosition=sectorPosition;
        setPosition(sectorPosition);
        Base.positionTV=position;
        setHere(object,position);
        super.printMap(position);
    }
}
