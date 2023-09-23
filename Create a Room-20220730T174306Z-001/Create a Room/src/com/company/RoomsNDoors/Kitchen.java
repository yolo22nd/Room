package com.company.RoomsNDoors;

import com.company.Base;
import com.company.You;

public class Kitchen extends Base {
    public String object = " Kitchen";
    public static String name = "a kitchen";
    public static int position=-10;
    public static int sectorPosition;
    public static int doorPosition;
    public void setPosition(int sectorPosition) {
        this.sectorPosition = sectorPosition;
        switch (sectorPosition) {
            case 8:
                doorPosition=31;
                position = 3;
                break;
            case 12:
                doorPosition=32;
                position = 11;
                break;
            case 14:
                doorPosition=33;
                position = 15;
                break;
            case 18:
                doorPosition=34;
                position = 23;
                break;
            default:
                position = -1;
        }
    }
    public void enterKitchen() {
        System.out.println("the kitchen and the TV are out of bounds.\n" +
                "WHY?, you ask,\n" +
                "complete the game for a legit explanation");
        System.out.println("you exited the kitchen.now you are in the main room.");
        You.position=sectorPosition;
        Base.setYou();
    }

    @Override
    public void printMap(int sectorPosition) {
        setPosition(sectorPosition);
        Base.positionKitchen=position;
        setHere(object,position);
        super.printMap(position);
    }
}
